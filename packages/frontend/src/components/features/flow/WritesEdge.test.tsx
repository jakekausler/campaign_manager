import { Position } from '@xyflow/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { renderWithReactFlow, cleanup } from '@/__tests__/utils/test-utils';

import { WritesEdge } from './WritesEdge';

// Phase 1 (Mitigation Plan) Task 1.2: Mock React Flow to reduce memory usage
vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});

// Common edge props for testing
const commonEdgeProps = {
  id: 'writes-edge',
  source: 'node-1',
  target: 'node-2',
  sourceX: 100,
  sourceY: 100,
  targetX: 200,
  targetY: 200,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
  data: {
    edgeType: 'WRITES' as const,
    metadata: { foo: 'bar' },
  },
  markerEnd: 'arrow-f97316', // String ID reference to SVG marker
};

describe('WritesEdge', () => {
  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });
  it('renders edge path', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
  });

  it('uses orange-500 color (#f97316)', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ stroke: '#f97316' });
  });

  it('uses stroke width of 2px', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '2' });
  });

  it('is animated', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    // Should have animated overlay
    const animatedPath = container.querySelector('path[style*="animation"]');
    expect(animatedPath).toBeInTheDocument();
  });

  it('has dashed line style (5,5 pattern)', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeDasharray: '5,5' });
  });

  it('animated overlay has correct opacity', () => {
    const { container } = renderWithReactFlow(<WritesEdge {...commonEdgeProps} />);

    const animatedPath = container.querySelector('path[style*="animation"]');
    expect(animatedPath).toHaveStyle({ opacity: '0.6' });
  });
});
