import { Position } from '@xyflow/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { renderWithReactFlow, cleanup } from '@/__tests__/utils/test-utils';

import { DependsOnEdge } from './DependsOnEdge';

// Common edge props for testing
const commonEdgeProps = {
  id: 'dependson-edge',
  source: 'node-1',
  target: 'node-2',
  sourceX: 100,
  sourceY: 100,
  targetX: 200,
  targetY: 200,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
  data: {
    edgeType: 'DEPENDS_ON' as const,
    metadata: { foo: 'bar' },
  },
  markerEnd: 'arrow-a855f7', // String ID reference to SVG marker
};

describe('DependsOnEdge', () => {
  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });
  it('renders edge path', () => {
    const { container } = renderWithReactFlow(<DependsOnEdge {...commonEdgeProps} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
  });

  it('uses purple-500 color (#a855f7)', () => {
    const { container } = renderWithReactFlow(<DependsOnEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ stroke: '#a855f7' });
  });

  it('uses stroke width of 2px', () => {
    const { container } = renderWithReactFlow(<DependsOnEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '2' });
  });

  it('is not animated', () => {
    const { container } = renderWithReactFlow(<DependsOnEdge {...commonEdgeProps} />);

    // Should not have animated overlay
    const animatedPath = container.querySelector('path[style*="animation"]');
    expect(animatedPath).not.toBeInTheDocument();
  });

  it('has dotted line style (2,2 pattern)', () => {
    const { container } = renderWithReactFlow(<DependsOnEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeDasharray: '2,2' });
  });
});
