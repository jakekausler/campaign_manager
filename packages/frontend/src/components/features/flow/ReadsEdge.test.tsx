import { Position } from '@xyflow/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { renderWithReactFlow, cleanup } from '@/__tests__/utils/test-utils';

import { ReadsEdge } from './ReadsEdge';

// Phase 1 (Mitigation Plan) Task 1.2: Mock React Flow to reduce memory usage
vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});

// Common edge props for testing
const commonEdgeProps = {
  id: 'reads-edge',
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

describe('ReadsEdge', () => {
  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });
  it('renders edge path', () => {
    const { container } = renderWithReactFlow(<ReadsEdge {...commonEdgeProps} />);

    const path = container.querySelector('path');
    expect(path).toBeInTheDocument();
  });

  it('uses slate-500 color (#64748b)', () => {
    const { container } = renderWithReactFlow(<ReadsEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ stroke: '#64748b' });
  });

  it('uses stroke width of 2px', () => {
    const { container } = renderWithReactFlow(<ReadsEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '2' });
  });

  it('is not animated', () => {
    const { container } = renderWithReactFlow(<ReadsEdge {...commonEdgeProps} />);

    // Should not have animated overlay
    const animatedPath = container.querySelector('path[style*="animation"]');
    expect(animatedPath).not.toBeInTheDocument();
  });

  it('has solid line style (no dash pattern)', () => {
    const { container } = renderWithReactFlow(<ReadsEdge {...commonEdgeProps} />);

    const path = container.querySelector('path.react-flow__edge-path');
    // Should not have strokeDasharray
    expect(path).not.toHaveStyle({ strokeDasharray: expect.anything() });
  });
});
