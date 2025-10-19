import { Position } from '@xyflow/react';
import { describe, it, expect } from 'vitest';

import { renderWithReactFlow } from '@/__tests__/utils/test-utils';

import { CustomEdge } from './CustomEdge';

// Common edge props for testing
const commonEdgeProps = {
  id: 'test-edge',
  source: 'node-1',
  target: 'node-2',
  sourceX: 100,
  sourceY: 100,
  targetX: 200,
  targetY: 200,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
  data: {
    edgeType: 'READS' as const,
    metadata: { foo: 'bar' },
  },
  markerEnd: 'arrow-64748b', // String ID reference to SVG marker
};

describe('CustomEdge', () => {
  it('renders edge path', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
  });

  it('applies custom stroke color', () => {
    const { container } = renderWithReactFlow(
      <CustomEdge {...commonEdgeProps} strokeColor="#ff0000" />
    );

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ stroke: '#ff0000' });
  });

  it('applies custom stroke width', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} strokeWidth={4} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '4' });
  });

  it('applies stroke dash pattern when provided', () => {
    const { container } = renderWithReactFlow(
      <CustomEdge {...commonEdgeProps} strokeDasharray="5,5" />
    );

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeDasharray: '5,5' });
  });

  it('renders label when provided', () => {
    const { getByText } = renderWithReactFlow(
      <CustomEdge {...commonEdgeProps} label="Test Label" />,
      {
        forEdges: true,
      }
    );

    expect(getByText('Test Label')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} />);

    // EdgeLabelRenderer should not have any children if no label
    const label = container.querySelector('.bg-background.border.rounded');
    expect(label).not.toBeInTheDocument();
  });

  it('renders animated overlay when animated is true', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} animated={true} />);

    // Should have 2 paths: base path and animated overlay
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render animated overlay when animated is false', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} animated={false} />);

    // Should only have 1 path: base path
    const animatedPath = container.querySelector('path[style*="animation"]');
    expect(animatedPath).not.toBeInTheDocument();
  });

  it('uses default stroke color when not provided', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ stroke: '#64748b' });
  });

  it('uses default stroke width when not provided', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '2' });
  });

  it('renders marker end for arrow', () => {
    const { container } = renderWithReactFlow(<CustomEdge {...commonEdgeProps} />);

    // BaseEdge passes markerEnd to the edge
    const edgePath = container.querySelector('path.react-flow__edge-path');
    expect(edgePath).toBeInTheDocument();
  });
});
